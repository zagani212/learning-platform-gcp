import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { guessAssetKindFromFile } from '../../lib/assetKind';
import {
  getMediaApiBase,
  createUploadJob,
  deleteMediaObject,
  completeUploadJob,
  getUploadJob,
  isCloudUploadableContentType,
  putWithProgress,
  resolveCourseAssetUrl,
} from '../../lib/mediaApi';
import { usePlatform } from '../../state/PlatformContext';

const FILE_INPUT_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',');

export function TeacherCourseMaterialsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { snapshot, registerCloudAsset, addLinkAsset, deleteAsset, getAuthorizationHeader } = usePlatform();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number>(0);
  const [openErr, setOpenErr] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [viewerBusy, setViewerBusy] = useState(false);

  const course = useMemo(
    () => snapshot.courses.find((c) => c.id === courseId),
    [snapshot.courses, courseId],
  );
  const assets = useMemo(
    () => (courseId ? snapshot.assets.filter((a) => a.courseId === courseId) : []),
    [snapshot.assets, courseId],
  );

  const mediaApiConfigured = Boolean(getMediaApiBase());

  if (!courseId || !course) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <p className="text-sm text-ink-600">Course not found.</p>
          <Link className="mt-4 inline-block text-sm text-accent-dark" to="/app/teacher">
            ← Back
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link to="/app/teacher" className="text-sm text-ink-500 hover:text-ink-800">
          ← All courses
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink-950">{course.title}</h1>
        <p className="mt-2 text-sm text-ink-600">{course.description}</p>
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-900">Upload files</h2>
        <p className="mt-2 text-sm text-ink-600">
          Files are stored in your S3 bucket (per-tenant prefix). The browser uploads with a signed URL from{' '}
          <code className="text-xs">media-service</code>; opening a file uses a short-lived read URL.
        </p>
        {!mediaApiConfigured && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Set <code className="text-xs">VITE_MEDIA_API_URL</code> in <code className="text-xs">web/.env</code> and
            run <code className="text-xs">media-service</code> with <code className="text-xs">S3_MEDIA_BUCKET</code>{' '}
            configured in <code className="text-xs">microservices/.env</code>.
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          className="hidden"
          disabled={uploadBusy || !mediaApiConfigured}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            setUploadErr(null);
            if (!file) return;
            if (!mediaApiConfigured) {
              setUploadErr('Media API URL is not configured.');
              return;
            }
            if (!file.type || !isCloudUploadableContentType(file.type)) {
              setUploadErr(
                'Unsupported type. Use images, video, PDF, audio (MP3/WAV/WebM), or Word/PowerPoint (DOC/DOCX/PPT/PPTX).',
              );
              return;
            }
            const auth = getAuthorizationHeader();
            if (!auth) {
              setUploadErr('Sign in required.');
              return;
            }
            setUploadBusy(true);
            setUploadPct(0);
            try {
              const job = await createUploadJob(auth, { fileName: file.name, contentType: file.type });
              if (!job.ok) {
                setUploadErr(`Upload init failed (${job.error}).`);
                return;
              }

              // Client uploads directly to S3 with progress.
              const put = await putWithProgress({
                url: job.data.uploadUrl,
                contentType: job.data.headers['Content-Type'],
                body: file,
                onProgress: (p) => {
                  if (typeof p.percent === 'number') setUploadPct(p.percent);
                },
              });
              if (!put.ok) {
                setUploadErr(`Upload failed (${put.status || put.error}).`);
                return;
              }

              // Ack immediately; server verifies in background. We poll for completion.
              const ack = await completeUploadJob(auth, job.data.jobId);
              if (!ack.ok) {
                setUploadErr(`Upload ack failed (${ack.error}).`);
                return;
              }

              const start = Date.now();
              while (Date.now() - start < 30_000) {
                const s = await getUploadJob(auth, job.data.jobId);
                if (s.ok && (s.job.status === 'uploaded' || s.job.status === 'failed')) {
                  if (s.job.status === 'failed') {
                    setUploadErr(`Upload processing failed (${s.job.error ?? 'unknown'}).`);
                    return;
                  }
                  break;
                }
                await new Promise((r) => setTimeout(r, 1200));
              }

              const title = file.name.replace(/\.[^.]+$/, '') || file.name;
              registerCloudAsset(course.id, {
                objectKey: job.data.objectKey,
                url: '',
                title,
                fileName: file.name,
                kind: guessAssetKindFromFile(file),
              });
            } finally {
              setUploadBusy(false);
            }
          }}
        />
        <Button
          variant="secondary"
          className="mt-4"
          disabled={uploadBusy || !mediaApiConfigured}
          onClick={() => fileRef.current?.click()}
        >
          {uploadBusy ? 'Uploading…' : 'Choose file'}
        </Button>
        {uploadBusy && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div className="h-full bg-accent" style={{ width: `${uploadPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-500">{uploadPct}%</p>
          </div>
        )}
        {uploadErr && <p className="mt-3 text-sm text-red-700">{uploadErr}</p>}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-900">Add link</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 md:col-span-2"
            placeholder="Title"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
          />
          <input
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 md:col-span-2"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>
        <Button
          className="mt-4"
          disabled={!linkTitle.trim() || !linkUrl.trim()}
          onClick={() => {
            addLinkAsset(course.id, linkTitle, linkUrl);
            setLinkTitle('');
            setLinkUrl('');
          }}
        >
          Save link
        </Button>
      </Card>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink-900">Materials ({assets.length})</h2>
        {openErr && <p className="mt-2 text-sm text-red-700">{openErr}</p>}

        {activeUrl && activeKind && (
          <Card className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-ink-900">{activeTitle || 'Preview'}</p>
                <p className="text-xs capitalize text-ink-500">{activeKind}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setActiveAssetId(null);
                  setActiveUrl(null);
                  setActiveKind(null);
                  setActiveTitle('');
                  setOpenErr(null);
                }}
              >
                Close
              </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-ink-200 bg-white">
              {activeKind === 'image' && (
                <img src={activeUrl} alt={activeTitle || 'Image'} className="max-h-[70vh] w-full object-contain" />
              )}
              {(activeKind === 'pdf' || activeKind === 'document') && (
                <iframe title={activeTitle || 'Document'} src={activeUrl} className="h-[70vh] w-full" />
              )}
              {activeKind === 'video' && (
                <video src={activeUrl} controls className="max-h-[70vh] w-full bg-black" />
              )}
              {activeKind === 'audio' && (
                <div className="p-4">
                  <audio src={activeUrl} controls className="w-full" />
                </div>
              )}
              {activeKind === 'link' && (
                <div className="p-4">
                  <a href={activeUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent-dark hover:underline">
                    Open link
                  </a>
                </div>
              )}
              {!['image', 'pdf', 'document', 'video', 'audio', 'link'].includes(activeKind) && (
                <div className="p-4">
                  <a href={activeUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent-dark hover:underline">
                    Open
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {viewerBusy && (
          <p className="mt-3 text-sm text-ink-500">Loading preview…</p>
        )}

        <ul className="mt-4 space-y-3">
          {assets.map((a) => (
            <li key={a.id}>
              <Card className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink-900">{a.title}</p>
                    <p className="text-xs capitalize text-ink-500">
                      {a.kind}
                      {a.gcsObjectKey ? ' · Bucket' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="text-sm text-accent-dark hover:underline"
                      onClick={async () => {
                        setOpenErr(null);
                        setViewerBusy(true);
                        setActiveAssetId(a.id);
                        setActiveKind(a.kind);
                        setActiveTitle(a.title);
                        try {
                          const r = await resolveCourseAssetUrl(a, getAuthorizationHeader);
                          if (!r.ok) {
                            setOpenErr(r.message);
                            return;
                          }
                          setActiveUrl(r.url);
                        } finally {
                          setViewerBusy(false);
                        }
                      }}
                    >
                      Preview
                    </button>

                    <button
                      type="button"
                      className="text-sm text-red-700 hover:underline"
                      onClick={async () => {
                        setOpenErr(null);
                        const auth = getAuthorizationHeader();
                        if (a.gcsObjectKey) {
                          if (!auth) {
                            setOpenErr('Sign in required.');
                            return;
                          }
                          const r = await deleteMediaObject(auth, a.gcsObjectKey);
                          if (!r.ok) {
                            setOpenErr(`Delete failed (${r.error}).`);
                            return;
                          }
                        }
                        deleteAsset(a.id);
                        if (activeAssetId === a.id) {
                          setActiveAssetId(null);
                          setActiveUrl(null);
                          setActiveKind(null);
                          setActiveTitle('');
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
          {assets.length === 0 && <p className="text-sm text-ink-500">No materials yet.</p>}
        </ul>
      </div>
    </div>
  );
}

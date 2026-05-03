export interface SchoolRow {
  school_id: string;
  name: string;
  slug: string;
  created_at: Date;
}

export interface SchoolDto {
  schoolId: string;
  name: string;
  slug: string;
  createdAt: string;
}

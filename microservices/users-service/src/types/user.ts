export interface UserRow {
  user_id: string;
  school_id: string;
  user_name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: Date;
}

export interface UserDto {
  userId: string;
  schoolId: string;
  userName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

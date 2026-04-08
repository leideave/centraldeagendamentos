export type UserRole = 'colaborador' | 'central' | 'admin';

export interface User {
  uid: string;
  name: string;
  role: UserRole;
  email?: string;
}

export type AppointmentStatus = 
  | 'pendente' 
  | 'compareceu' 
  | 'nao_compareceu' 
  | 'inscreveu' 
  | 'nao_fechou_matricula' 
  | 'matriculado';

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  clientData: string;
  time: string; // ISO string
  course: string;
  status: AppointmentStatus;
  observations: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  rescheduledFrom?: string; // ID of previous appointment if rescheduled
}

export interface DeletedAppointment {
  id: string;
  appointmentData: Appointment;
  deletedBy: string;
  deletedByName: string;
  deletedAt: string;
}

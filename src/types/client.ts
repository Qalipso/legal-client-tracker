export type ClientStatus = "new" | "in_progress" | "waiting_client" | "closed";

export type Client = {
  id: string;
  name: string;
  phone: string;
  status: ClientStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

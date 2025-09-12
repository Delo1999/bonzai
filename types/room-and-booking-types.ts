export enum RoomType {
  SINGLE = `SINGLE`,
  DOUBLE = `DOUBLE`,
  SUITE = `SUITE`,
}

export type Room = {
  type: RoomType;
  quantity: number;
};

export type Booking = {
  bookingId: string;
  guestName: string;
  numberOfGuests: number;
  rooms: Room[];
  totalPrice: number;
  createdAt: string;
};

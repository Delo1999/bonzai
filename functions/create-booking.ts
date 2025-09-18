import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { Booking, Room, RoomType } from "../types/room-and-booking-types";

const dynamodb = new DynamoDBClient({ region: "eu-north-1" });

const ROOM_PRICES = {
  [RoomType.SINGLE]: 500,
  [RoomType.DOUBLE]: 1000,
  [RoomType.SUITE]: 1500,
};

const TOTAL_HOTEL_ROOMS = 20;

const getTotalBookedRooms = async (): Promise<number> => {
  const command = new ScanCommand({
    TableName: "bookings-table",
  });

  const response = await dynamodb.send(command);
  const bookings =
    response.Items?.map((item) => ({
      rooms: JSON.parse(item.rooms.S || "[]"),
    })) || [];

  return bookings.reduce(
    (total, booking) =>
      total +
      booking.rooms.reduce(
        (roomTotal: number, room: Room) => roomTotal + room.quantity,
        0
      ),
    0
  );
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { guestName, numberOfGuests, rooms } = body;

    if (!guestName || !numberOfGuests || !rooms) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const totalCapacity = rooms.reduce((acc: number, room: Room) => {
      switch (room.type) {
        case RoomType.SINGLE:
          return acc + 1 * room.quantity;
        case RoomType.DOUBLE:
          return acc + 2 * room.quantity;
        case RoomType.SUITE:
          return acc + 3 * room.quantity;
        default:
          return acc;
      }
    }, 0);

    if (totalCapacity < numberOfGuests) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Room capacity does not match number of guests",
        }),
      };
    }

    const requestedRooms = rooms.reduce(
      (total: number, room: Room) => total + room.quantity,
      0
    );
    const currentlyBooked = await getTotalBookedRooms();

    if (currentlyBooked + requestedRooms > TOTAL_HOTEL_ROOMS) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Cannot book ${requestedRooms} rooms. Only ${
            TOTAL_HOTEL_ROOMS - currentlyBooked
          } rooms available.`,
        }),
      };
    }

    const totalPrice = rooms.reduce((acc: number, room: Room) => {
      return acc + ROOM_PRICES[room.type] * room.quantity;
    }, 0);

    const booking: Booking = {
      bookingId: uuidv4(),
      guestName,
      numberOfGuests,
      rooms,
      totalPrice,
      createdAt: new Date().toISOString(),
    };

    await dynamodb.send(
      new PutItemCommand({
        TableName: "bookings-table",
        Item: {
          bookingId: { S: booking.bookingId },
          guestName: { S: booking.guestName },
          numberOfGuests: { N: numberOfGuests.toString() },
          rooms: { S: JSON.stringify(rooms) },
          totalPrice: { N: totalPrice.toString() },
          createdAt: { S: booking.createdAt },
        },
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Booking created successfully",
        booking,
      }),
    };
  } catch (error) {
    console.error("Error creating booking:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create booking" }),
    };
  }
};

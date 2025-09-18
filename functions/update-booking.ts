import {
  DynamoDBClient,
  UpdateItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Room } from "../types/room-and-booking-types";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const client = new DynamoDBClient({ region: "eu-north-1" });

const TOTAL_HOTEL_ROOMS = 20;

const validateBooking = (numberOfGuests: number, rooms: Room[]): boolean => {
  const roomCapacity = rooms.reduce((total, room) => {
    switch (room.type) {
      case "SINGLE":
        return total + 1;
      case "DOUBLE":
        return total + 2;
      case "SUITE":
        return total + 3;
      default:
        return total;
    }
  }, 0);

  return numberOfGuests <= roomCapacity;
};

const getTotalBookedRooms = async (
  excludeBookingId?: string
): Promise<number> => {
  const command = new ScanCommand({
    TableName: "bookings-table",
  });

  const response = await client.send(command);
  const bookings = response.Items?.map((item) => unmarshall(item)) || [];

  return bookings.reduce((total, booking) => {
    // Skip the booking being updated
    if (booking.bookingId === excludeBookingId) return total;

    const rooms =
      typeof booking.rooms === "string"
        ? JSON.parse(booking.rooms)
        : booking.rooms;

    return (
      total +
      rooms.reduce(
        (roomTotal: number, room: Room) => roomTotal + room.quantity,
        0
      )
    );
  }, 0);
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const bookingId = event.pathParameters?.bookingId;
    const body = JSON.parse(event.body || "{}");
    const { guestName, guests: numberOfGuests, rooms } = body;

    if (!bookingId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Booking ID is required",
        }),
      };
    }

    if (!Array.isArray(guestName)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Guest names must be provided as an array",
        }),
      };
    }

    if (guestName.length !== numberOfGuests) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Number of guest names must match number of guests",
        }),
      };
    }

    const requestedRooms = rooms.reduce(
      (total: number, room: Room) => total + room.quantity,
      0
    );
    const currentlyBooked = await getTotalBookedRooms(bookingId);

    if (currentlyBooked + requestedRooms > TOTAL_HOTEL_ROOMS) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: `Cannot book ${requestedRooms} rooms. Only ${
            TOTAL_HOTEL_ROOMS - currentlyBooked
          } rooms available.`,
        }),
      };
    }

    if (!validateBooking(numberOfGuests, rooms)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Invalid room configuration for number of guests",
        }),
      };
    }

    const updateCommand = new UpdateItemCommand({
      TableName: "bookings-table",
      Key: marshall({ bookingId }),
      UpdateExpression:
        "SET guests = :guests, rooms = :rooms, guestName = :guestName",
      ExpressionAttributeValues: marshall({
        ":guests": numberOfGuests,
        ":rooms": rooms,
        ":guestName": guestName,
      }),
      ReturnValues: "ALL_NEW",
    });

    const response = await client.send(updateCommand);
    const updatedBooking = unmarshall(response.Attributes || {});

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        booking: updatedBooking,
      }),
    };
  } catch (error) {
    console.error("Error updating booking:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Error updating booking",
      }),
    };
  }
};

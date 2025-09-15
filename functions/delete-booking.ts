import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const client = new DynamoDBClient({ region: "eu-north-1" });

export const deleteBooking = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const bookingId = event.pathParameters?.bookingId;

    if (!bookingId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Booking ID is required",
        }),
      };
    }

    const command = new DeleteItemCommand({
      TableName: "bookings-table",
      Key: marshall({ bookingId }),
      ReturnValues: "ALL_OLD",
    });

    await client.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Booking deleted successfully",
      }),
    };
  } catch (error) {
    console.error("Error deleting booking:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Error deleting booking",
      }),
    };
  }
};

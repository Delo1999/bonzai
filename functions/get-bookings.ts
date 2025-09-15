import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const client = new DynamoDBClient({ region: "eu-north-1" });

export const getBookings = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const command = new ScanCommand({
      TableName: "bookings-table",
    });

    const response = await client.send(command);
    const bookings =
      response.Items?.map((item) => {
        const booking = unmarshall(item);
        // Parse the rooms string back to an object
        return {
          ...booking,
          rooms: JSON.parse(booking.rooms),
        };
      }) || [];

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        bookings: bookings,
      }),
    };
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Error fetching bookings",
      }),
    };
  }
};

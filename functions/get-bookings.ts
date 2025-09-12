import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEventV2 } from "aws-lambda";

const client = new DynamoDBClient({ region: "eu-north-1" });

export const getBookings = async (event: APIGatewayProxyEventV2) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Go Serverless v4! Your function executed successfully!",
    }),
  };
};

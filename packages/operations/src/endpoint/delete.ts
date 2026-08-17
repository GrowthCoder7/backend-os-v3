import { ArchitectureOperation } from "../operation";

export type DeleteEndpointPayload = {
  lookup: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
  };
};

export type EndpointDeleteOperation = ArchitectureOperation<
  "endpoint.delete",
  DeleteEndpointPayload
>;
import { Endpoint } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type UpdateEndpointPayload = {
  lookup: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
  };
  partialEndpoint: Partial<Endpoint>;
};

export type EndpointUpdateOperation = ArchitectureOperation<
  "endpoint.update",
  UpdateEndpointPayload
>;
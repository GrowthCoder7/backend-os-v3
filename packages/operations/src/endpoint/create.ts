import { Endpoint } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type CreateEndpointPayload = {
  endpoint: Endpoint;
};

export type EndpointCreateOperation = ArchitectureOperation<
  "endpoint.create",
  CreateEndpointPayload
>;
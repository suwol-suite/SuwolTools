export type HttpStatusCode = {
  code: number;
  name: string;
  description: string;
};

export const httpStatusCodes: HttpStatusCode[] = [
  { code: 100, name: "Continue", description: "The initial part of the request was received and the client can continue." },
  { code: 101, name: "Switching Protocols", description: "The server is switching protocols as requested by the client." },
  { code: 200, name: "OK", description: "The request succeeded." },
  { code: 201, name: "Created", description: "The request succeeded and a new resource was created." },
  { code: 204, name: "No Content", description: "The request succeeded and there is no response body." },
  { code: 301, name: "Moved Permanently", description: "The resource has been assigned a new permanent URL." },
  { code: 302, name: "Found", description: "The resource is temporarily available at another URL." },
  { code: 304, name: "Not Modified", description: "The cached representation can be reused." },
  { code: 400, name: "Bad Request", description: "The server cannot process the request because it is malformed." },
  { code: 401, name: "Unauthorized", description: "Authentication is required or has failed." },
  { code: 403, name: "Forbidden", description: "The server understood the request but refuses to authorize it." },
  { code: 404, name: "Not Found", description: "The requested resource was not found." },
  { code: 405, name: "Method Not Allowed", description: "The HTTP method is not allowed for the target resource." },
  { code: 409, name: "Conflict", description: "The request conflicts with the current state of the resource." },
  { code: 422, name: "Unprocessable Content", description: "The request is syntactically valid but semantically invalid." },
  { code: 429, name: "Too Many Requests", description: "The client has sent too many requests in a given amount of time." },
  { code: 500, name: "Internal Server Error", description: "The server encountered an unexpected condition." },
  { code: 502, name: "Bad Gateway", description: "The server received an invalid response from an upstream server." },
  { code: 503, name: "Service Unavailable", description: "The server is currently unavailable or overloaded." },
  { code: 504, name: "Gateway Timeout", description: "The upstream server did not respond in time." },
];

export function getStatusClass(code: number): string {
  return `${Math.floor(code / 100)}xx`;
}

export function filterHttpStatusCodes(query: string, statusClass: string): HttpStatusCode[] {
  const normalizedQuery = query.trim().toLowerCase();

  return httpStatusCodes.filter((status) => {
    const matchesClass = statusClass === "all" || getStatusClass(status.code) === statusClass;
    const haystack = `${status.code} ${status.name} ${status.description}`.toLowerCase();
    return matchesClass && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}

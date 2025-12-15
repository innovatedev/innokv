import { PageProps } from "fresh";
import { HttpError } from "fresh";
import { DatabaseError } from "@/lib/BaseRepository.ts";

export default function Error500({ error, url }: PageProps) {
  let title = "500 - Server Error";
  let message = "An internal server error occurred.";
  let status = 500;

  if (error instanceof HttpError) {
    status = error.status;
    switch (status) {
      case 400:
        title = "400 - Bad Request";
        message = error.message || "The request was invalid.";
        break;
      case 403:
        title = "403 - Forbidden";
        message = error.message ||
          "You do not have permission to access this page.";
        break;
      case 404:
        title = "404 - Not Found";
        message = error.message || "The requested page was not found.";
        break;
      default:
        title = `${status} - Error`;
        message = error.message;
    }
  } else if (error instanceof DatabaseError) {
    status = 503;
    title = "503 - Database Error";
    message = error.message || "The database service is currently unavailable.";
  } else {
    console.log(error);
  }

  return (
    <div class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4">
      <div class="text-center space-y-4">
        <h1 class="text-6xl font-bold text-error">{status}</h1>
        <h2 class="text-2xl font-bold">{title}</h2>
        <p class="opacity-70">{message}</p>
        {url.pathname !== "/" && (
          <div class="pt-8">
            <a href="/" class="btn btn-primary">
              Go Home
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

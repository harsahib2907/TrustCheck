import { RouterProvider } from "react-router";
import { router } from "./routes";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID, hasGoogleClientId } from "./lib/config";


export default function App() {
  if (!hasGoogleClientId()) {
    return <RouterProvider router={router} />;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <RouterProvider router={router} />
    </GoogleOAuthProvider>
  );
}

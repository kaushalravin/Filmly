import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { checkAuth } from "../utilities/auth";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [isAuthed, setIsAuthed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    checkAuth()
      .then((ok) => {
        if (!cancelled) setIsAuthed(ok);
      })
      .catch(() => {
        if (!cancelled) setIsAuthed(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthed === null) return null;

  if (!isAuthed) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return children;
}
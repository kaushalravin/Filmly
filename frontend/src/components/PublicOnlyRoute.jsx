import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { checkAuth } from "../utilities/auth";

export default function PublicOnlyRoute({ children }) {
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

  if (isAuthed) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "./Navbar.jsx";
import Favorites from "./Favorites.jsx";
import WatchLater from "./watchLater.jsx";
import Friends from "./Friends.jsx";
import "../styles/profile.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setMessage("");

        const response = await axios.get(`${VITE_BACKEND_BASE}/api/me`);

        if (!cancelled) {
          setProfile(response?.data?.data?.user || null);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        if (!cancelled) {
          setMessage("Failed to load profile information.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="filmly-profile-page">
      <Navbar />
      <div className="filmly-profile-glow filmly-profile-glow-left" />
      <div className="filmly-profile-glow filmly-profile-glow-right" />

      <section className="filmly-profile-shell">
        <section className="filmly-profile-header">
          <div>
            <span className="filmly-profile-eyebrow">Account</span>
            <h1>{profile?.username || "Your profile"}</h1>
            <p>Manage your Filmly identity and keep track of your connections.</p>
          </div>

          <div className="filmly-profile-badge">
            <span>Member since</span>
            <strong>{profile?.id ? "Active user" : "Loading..."}</strong>
          </div>
        </section>

        {message && <div className="filmly-profile-status error">{message}</div>}
        {loading && <div className="filmly-profile-status">Loading profile...</div>}

        {!loading && profile && (
          <section className="filmly-profile-card">
            <div className="filmly-profile-avatar">{profile.username?.slice(0, 1).toUpperCase()}</div>

            <div className="filmly-profile-copy">
              <h2>{profile.username}</h2>
              <p>{profile.email || "No email shown in current session payload."}</p>

              <div className="filmly-profile-stats">
                <div className="filmly-profile-stat">
                  <span>User ID</span>
                  <strong>{profile.id}</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && profile && <Favorites />}

        {!loading && profile && <WatchLater />}

        {!loading && profile && <Friends currentUserId={profile.id} />}
      </section>
    </main>
  );
}
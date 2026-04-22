import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../styles/friends.css";

const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || import.meta.env.VITE_API_BASE || "";

const getFriendUser = (friendship, currentUserId) => {
  const fromUser = friendship?.fromUserId;
  const toUser = friendship?.toUserId;

  if (fromUser?._id?.toString() === currentUserId) return toUser;
  if (toUser?._id?.toString() === currentUserId) return fromUser;
  return toUser || fromUser || null;
};

function FriendRow({ user, actionLabel, onAction, actionDisabled, actionTone = "solid" }) {
  return (
    <article className="filmly-friend-row">
      <div className="filmly-friend-row-avatar">{(user?.username || "?").slice(0, 1).toUpperCase()}</div>

      <div className="filmly-friend-row-copy">
        <h3>{user?.username || "Unknown user"}</h3>
        <p>{user?.email || "Movie buddy"}</p>
      </div>

      <button type="button" className={`filmly-friend-row-action ${actionTone}`} onClick={onAction} disabled={actionDisabled}>
        {actionLabel}
      </button>
    </article>
  );
}

function SearchResultRow({ user, onSendRequest, sending, disabled }) {
  const statusLabel =
    user?.status === "accepted"
      ? "Friends"
      : user?.status === "pending"
        ? "Request pending"
        : "Send request";

  return (
    <article className="filmly-friend-row search-result">
      <div className="filmly-friend-row-avatar">{(user?.username || "?").slice(0, 1).toUpperCase()}</div>

      <div className="filmly-friend-row-copy">
        <h3>{user?.username || "Unknown user"}</h3>
        <p>{user?.email || "Movie buddy"}</p>
      </div>

      <button
        type="button"
        className="filmly-friend-row-action solid"
        onClick={onSendRequest}
        disabled={disabled || user?.status === "accepted" || user?.status === "pending"}
      >
        {sending ? "Sending..." : statusLabel}
      </button>
    </article>
  );
}

export default function Friends({ currentUserId }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [sendingUserId, setSendingUserId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchFriends = async () => {
      try {
        setLoading(true);
        setMessage("");

        const [friendsResponse, requestsResponse] = await Promise.all([
          axios.get(`${VITE_BACKEND_BASE}/api/friends`),
          axios.get(`${VITE_BACKEND_BASE}/api/friends/requests`),
        ]);

        if (cancelled) return;

        setFriends(friendsResponse?.data?.data || []);
        setRequests(requestsResponse?.data?.data || []);
      } catch (error) {
        console.error("Error fetching friends:", error);
        if (!cancelled) {
          setMessage("Failed to load your friends right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchFriends();

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = requests.length;
  const friendsCount = friends.length;

  const acceptedFriends = useMemo(
    () => friends.map((friendship) => ({
      id: friendship?._id,
      user: getFriendUser(friendship, currentUserId),
    })),
    [friends, currentUserId]
  );

  const handleSearch = async (event) => {
    event.preventDefault();

    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      setSearchMessage("Type a username to search for users.");
      return;
    }

    try {
      setSearching(true);
      setSearchMessage("");

      const response = await axios.post(`${VITE_BACKEND_BASE}/api/friends/search`, {
        username: query,
      });

      setSearchResults(response?.data?.data || []);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
      setSearchMessage("Failed to search users right now.");
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      setSendingUserId(userId);
      await axios.post(`${VITE_BACKEND_BASE}/api/friends/request/${userId}`);
      setSearchResults((prev) =>
        prev.map((user) => (user._id === userId ? { ...user, status: "pending" } : user))
      );
    } catch (error) {
      console.error("Error sending friend request:", error);
      setSearchMessage(error?.response?.data?.message || "Failed to send friend request.");
    } finally {
      setSendingUserId("");
    }
  };

  const handleAccept = async (requestId) => {
    try {
      setBusyId(requestId);
      await axios.patch(`${VITE_BACKEND_BASE}/api/friends/accept/${requestId}`);
      setRequests((prev) => prev.filter((request) => request._id !== requestId));
      const refreshed = await axios.get(`${VITE_BACKEND_BASE}/api/friends`);
      setFriends(refreshed?.data?.data || []);
    } catch (error) {
      console.error("Error accepting friend request:", error);
    } finally {
      setBusyId("");
    }
  };

  const handleReject = async (requestId) => {
    try {
      setBusyId(requestId);
      await axios.post(`${VITE_BACKEND_BASE}/api/friends/reject/${requestId}`);
      setRequests((prev) => prev.filter((request) => request._id !== requestId));
    } catch (error) {
      console.error("Error rejecting friend request:", error);
    } finally {
      setBusyId("");
    }
  };

  const handleUnfriend = async (friendId) => {
    try {
      setBusyId(friendId);
      await axios.delete(`${VITE_BACKEND_BASE}/api/friends/unfriend/${friendId}`);
      setFriends((prev) => prev.filter((friendship) => friendship._id !== friendId));
    } catch (error) {
      console.error("Error unfriending user:", error);
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="filmly-friends-section">
      <div className="filmly-friends-section-head">
        <div>
          <span className="filmly-friends-eyebrow">Connections</span>
          <h2>Friends and requests</h2>
          <p>Manage the people you follow, accept requests, or remove connections.</p>
        </div>

        <div className="filmly-friends-stats">
          <div className="filmly-friends-stat">
            <span>Friends</span>
            <strong>{friendsCount}</strong>
          </div>
          <div className="filmly-friends-stat">
            <span>Requests</span>
            <strong>{pendingCount}</strong>
          </div>
        </div>
      </div>

      {message && <div className="filmly-friends-status error">{message}</div>}
      {loading && <div className="filmly-friends-status">Loading friends...</div>}

      {!loading && !message && acceptedFriends.length === 0 && requests.length === 0 && (
        <div className="filmly-friends-status">No friends or requests yet.</div>
      )}

      {!loading && requests.length > 0 && (
        <div className="filmly-friends-group">
          <div className="filmly-friends-group-head">
            <h3>Pending requests</h3>
            <span>{requests.length}</span>
          </div>

          <div className="filmly-friends-list">
            {requests.map((request) => (
              <article key={request._id} className="filmly-friend-row request">
                <div className="filmly-friend-row-avatar">{(request?.fromUserId?.username || "?").slice(0, 1).toUpperCase()}</div>
                <div className="filmly-friend-row-copy">
                  <h3>{request?.fromUserId?.username || "Unknown user"}</h3>
                  <p>Sent you a friend request</p>
                </div>
                <div className="filmly-friend-row-actions">
                  <button
                    type="button"
                    className="filmly-friend-row-action solid"
                    onClick={() => handleAccept(request._id)}
                    disabled={busyId === request._id}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="filmly-friend-row-action ghost"
                    onClick={() => handleReject(request._id)}
                    disabled={busyId === request._id}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!loading && acceptedFriends.length > 0 && (
        <div className="filmly-friends-group">
          <div className="filmly-friends-group-head">
            <h3>Friends</h3>
            <span>{acceptedFriends.length}</span>
          </div>

          <div className="filmly-friends-list">
            {acceptedFriends.map(({ id, user }) => (
              <FriendRow
                key={id}
                user={user}
                actionLabel="Unfriend"
                actionTone="ghost"
                actionDisabled={busyId === id}
                onAction={() => handleUnfriend(id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="filmly-friends-group filmly-friends-search-group">
        <div className="filmly-friends-group-head">
          <h3>Find users</h3>
          <span>Search by username</span>
        </div>

        <form className="filmly-friends-search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search usernames"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search users"
          />
          <button type="submit" className="filmly-friend-row-action solid" disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {searchMessage && <div className="filmly-friends-status">{searchMessage}</div>}

        {!searching && searchResults.length > 0 && (
          <div className="filmly-friends-list">
            {searchResults.map((user) => (
              <SearchResultRow
                key={user._id}
                user={user}
                sending={sendingUserId === user._id}
                disabled={sendingUserId === user._id}
                onSendRequest={() => handleSendRequest(user._id)}
              />
            ))}
          </div>
        )}

        {!searching && searchTerm.trim() && searchResults.length === 0 && !searchMessage && (
          <div className="filmly-friends-status">No users found for that search.</div>
        )}
      </div>
    </section>
  );
}
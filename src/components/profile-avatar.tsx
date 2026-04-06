"use client";

import { ProfileEditModal } from "@/components/profile-edit-modal";

interface ProfileAvatarProps {
  user: {
    fullName: string | null;
    imageUrl: string | null;
    primaryEmailAddress: {
      emailAddress: string;
    } | null;
    primaryEmailAddressVerificationStatus: string | undefined;
  };
}

export function ProfileAvatar({ user }: ProfileAvatarProps) {
  const initials = user.fullName
    ?.split(" ")
    .map((name) => name[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="flex items-center gap-6">
      {/* Avatar */}
      <ProfileEditModal>
        <div className="relative group cursor-pointer flex-shrink-0">
          {user.imageUrl ? (
            <div className="relative w-32 h-32">
              <img
                src={user.imageUrl}
                alt={user.fullName || "User"}
                className="w-full h-full rounded-full object-cover"
                style={{ boxShadow: "0 0 0 3px rgba(200,169,110,.5)" }}
                crossOrigin="anonymous"
                loading="eager"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
              </div>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full flex items-center justify-center text-[#c8a96e] font-black text-4xl"
              style={{ background: "rgba(200,169,110,.12)", boxShadow: "0 0 0 3px rgba(200,169,110,.35)" }}>
              {initials}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "#c8a96e", boxShadow: "0 0 0 2px #0f1e38" }}>
            <svg className="w-3.5 h-3.5" fill="#0f1e38" viewBox="0 0 24 24">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
        </div>
      </ProfileEditModal>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl font-extrabold text-white leading-tight">
          {user.fullName || "User"}
        </h1>
        <p className="text-sm font-medium mt-1.5" style={{ color: "#c8a96e" }}>
          {user.primaryEmailAddress?.emailAddress || "No email"}
        </p>
        <div className="flex items-center gap-2 mt-3">
          {user.primaryEmailAddressVerificationStatus === "verified" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(34,197,94,.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,.2)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Verified
            </span>
          )}
          <ProfileEditModal>
            <button className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.15)" }}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              Edit Profile
            </button>
          </ProfileEditModal>
        </div>
      </div>
    </div>
  );
}

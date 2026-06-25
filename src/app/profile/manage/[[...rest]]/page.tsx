"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";

export default function ManageProfilePage() {
  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-[rgba(20,33,29,0.08)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-ink-soft hover:text-brand font-medium transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to profile</span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink">Manage account</h1>
          <div className="w-32" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <UserProfile
            routing="hash"
            appearance={{
              variables: { colorPrimary: "#0C6B57" },
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-none",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

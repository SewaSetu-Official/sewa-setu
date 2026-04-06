"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";

export default function ManageProfilePage() {
  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-[#a88b50] hover:text-[#0f1e38] font-medium transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Profile</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Manage Account</h1>
          <div className="w-32" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <UserProfile
            routing="hash"
            appearance={{
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

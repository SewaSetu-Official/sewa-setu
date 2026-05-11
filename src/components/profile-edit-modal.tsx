"use client";

import { useState, ReactNode } from "react";
import { UserProfile } from "@clerk/nextjs";
import { X, RefreshCw } from "lucide-react";

interface ProfileEditModalProps {
  children?: ReactNode;
}

export function ProfileEditModal({ children }: ProfileEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (children) {
    return (
      <>
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">
          {children}
        </div>

        {isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0f1e38] to-[#1a3059] border-b border-[#0f1e38] px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Edit Your Profile</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh to see changes"
                  >
                    <RefreshCw size={18} className={`text-white/70 ${isRefreshing ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={handleClose}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title="Close"
                  >
                    <X size={20} className="text-white/70" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-8">
                  <UserProfile
                    routing="hash"
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#0f1e38] text-[#c8a96e] font-semibold text-xs sm:text-sm hover:bg-[#1a3059] transition-colors shadow-md hover:shadow-lg"
      >
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z"/>
        </svg>
        Edit
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0f1e38] to-[#1a3059] border-b border-[#0f1e38] px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Edit Your Profile</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh to see changes"
                >
                  <RefreshCw size={18} className={`text-gray-600 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Close"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-8">
                <UserProfile
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

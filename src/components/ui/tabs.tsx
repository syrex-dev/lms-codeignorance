"use client";

import React, { createContext, useContext } from "react";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ value, onValueChange, className = "", children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ activeTab: value, setActiveTab: onValueChange }}>
      <div className={`w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex border-b border-[#E3E6EB] gap-6 text-sm font-medium ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className = "",
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = context.activeTab === value;

  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={`pb-2.5 -mb-px flex items-center gap-2 text-sm transition-colors border-b-2 font-medium ${
        isActive
          ? "border-[#1F4E8C] text-[#1F4E8C] font-semibold"
          : "border-transparent text-[#4B5563] hover:text-[#111827] hover:border-[#CBD5E1]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className = "",
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  if (context.activeTab !== value) return null;
  return <div className={`pt-4 ${className}`}>{children}</div>;
}

import AdminNav from "./AdminNav";
import { UnsavedChangesProvider } from "./UnsavedChangesContext";
import { LayoutModeProvider } from "./LayoutModeContext";
import { APP_VERSION } from "@/lib/version";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UnsavedChangesProvider>
      <LayoutModeProvider>
        <div className="min-h-screen flex flex-col sm:flex-row">
          <AdminNav />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
        <span className="fixed top-2 right-3 z-40 text-[10px] tracking-wide text-cream/25 select-none pointer-events-none">
          {APP_VERSION}
        </span>
      </LayoutModeProvider>
    </UnsavedChangesProvider>
  );
}

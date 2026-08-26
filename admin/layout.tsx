import AdminNav from "./AdminNav";
import { UnsavedChangesProvider } from "./UnsavedChangesContext";
import { LayoutModeProvider } from "./LayoutModeContext";

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
      </LayoutModeProvider>
    </UnsavedChangesProvider>
  );
}

import { ReactNode } from "react";

interface ThreeColLayoutProps {
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
}

export function ThreeColLayout({ left, center, right }: ThreeColLayoutProps) {
  return (
    <div className="flex h-full w-full">
      {left && <aside className="w-64 border-r">{left}</aside>}
      <main className="flex flex-1 flex-col">{center}</main>
      {right && <aside className="w-80 border-l">{right}</aside>}
    </div>
  );
}

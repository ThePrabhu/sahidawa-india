import { ArrowLeft, Globe, Zap } from "lucide-react";
import Link from "next/link";

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  backHref: string;
  variant?: "dark" | "light";
  showLanguage?: boolean;
  languageName?: string;
  children?: React.ReactNode;
}

export const PageHeader = ({ 
  title, 
  subtitle, 
  backHref, 
  variant = "dark", 
  showLanguage = false,
  languageName,
  children 
}: PageHeaderProps) => {
  
  const isDark = variant === "dark";
  
  return (
    <header className={`${isDark ? "absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent text-white" : "relative bg-white border-b border-slate-100 shadow-sm text-slate-900"} z-20 p-4 flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <Link 
          href={backHref} 
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isDark ? "bg-white/10 backdrop-blur-md hover:bg-white/20" : "bg-slate-100 hover:bg-slate-200"
          }`}
        >
          <ArrowLeft size={24} className={isDark ? "text-white" : "text-slate-600"} />
        </Link>

        {children ? (
          <div className="flex-1 px-4">{children}</div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
              {title}
            </span>
            <span className="text-sm font-medium">{subtitle}</span>
          </div>
        )}

        <div className="flex items-center justify-end w-10">
          {showLanguage ? (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm whitespace-nowrap">
              <Globe size={16} className="text-emerald-600" />
              <span className="text-sm font-bold text-slate-700">{languageName || "English"}</span>
            </div>
          ) : isDark ? (
            <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
              <Zap size={20} className="text-amber-400" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
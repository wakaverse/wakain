interface Props {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({ title, children }: Props) {
  return (
    <div>
      <div className="px-4 py-3 bg-white rounded-t-2xl border border-b-0 border-gray-100">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
      </div>
      <div className="mt-0">
        {children}
      </div>
    </div>
  );
}

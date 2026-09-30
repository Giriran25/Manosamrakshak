import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

export const NotFoundPage = () => {
  const session = useAppStore((s) => s.session);
  const home = session
    ? session.role === 'victim'
      ? '/victim'
      : session.role === 'admin'
        ? '/admin/identity'
        : '/counsellor'
    : '/';

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="text-display-sm text-ink-900">There is nothing at this address</h1>
      <p className="text-[14px] leading-relaxed text-ink-500">
        The link may be out of date. Everything in the prototype is reachable from the main screens.
      </p>
      <Link to={home} className="btn-primary">
        Go back
      </Link>
    </div>
  );
};

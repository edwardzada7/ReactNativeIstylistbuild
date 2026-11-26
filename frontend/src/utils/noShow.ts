import { Colors } from '../constants/theme';

export const NO_SHOW_STATUSES = ['no_show_pending', 'user_no_show', 'provider_no_show', 'disputed'];
export const CANCELLED_STATUSES = ['canceled', 'cancelled', 'declined', 'rejected', 'no_response'];
export const isNoResponseStatus = (status?: string | null) => String(status || '').toLowerCase() === 'no_response';

export const isNoShowStatus = (status?: string | null) => NO_SHOW_STATUSES.includes(String(status || '').toLowerCase());

export interface NoShowResolution {
  label: string;
  detail: string;
  color: string;
  resolved: boolean;
}

/** Plain-language resolution status for a no-show / disputed booking, from the viewer's side. */
export function noShowResolution(booking: any, role: 'customer' | 'provider'): NoShowResolution {
  const status = String(booking?.status || '').toLowerCase();
  const reporter = booking?.no_show_reporter_role as string | undefined;
  const reportedByMe = reporter ? reporter === role : false;
  switch (status) {
    case 'no_show_pending': {
      const deadline = booking?.no_show_deadline ? new Date(booking.no_show_deadline) : null;
      const until = deadline && Number.isFinite(deadline.getTime()) ? ` Response window ends ${deadline.toLocaleString()}.` : '';
      return {
        label: 'Awaiting response',
        detail: (reportedByMe
          ? 'You reported a no-show. Waiting for the other party to accept or dispute it.'
          : 'A no-show was reported. Open the booking to accept it or dispute it with your reason.') + until,
        color: Colors.warning,
        resolved: false,
      };
    }
    case 'disputed':
      return { label: 'Under admin review', detail: 'The no-show was disputed. An admin is reviewing it and the booking is on hold.', color: Colors.warning, resolved: false };
    case 'user_no_show':
      return { label: 'Resolved: customer no-show', detail: 'The no-show was confirmed. This booking is closed.', color: Colors.error, resolved: true };
    case 'provider_no_show':
      return { label: 'Resolved: provider no-show', detail: 'The no-show was confirmed. This booking is closed.', color: Colors.error, resolved: true };
    default:
      return { label: '', detail: '', color: Colors.textMuted, resolved: false };
  }
}

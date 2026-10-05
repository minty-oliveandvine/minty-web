/**
 * One member of the company: initials, name and address, the role (a select where this person
 * may change it - roles at or below their own), the "Subscriber" tag on the person whose card
 * pays, "You" on their own row, and Remove where they may remove. On a phone the row stacks
 * (name over role and actions); from 640px it is one line.
 */

import type { Member, RoleOption } from "@/features/company-settings/api/companySettings";

const TAG = "inline-flex shrink-0 items-center rounded-full bg-[#eefbfb] px-2 py-0.5 text-xs font-medium text-[#1b9aa0]";
export const ROLE_SELECT =
  "h-11 min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25 disabled:bg-gray-50";

export function MemberRow({
  member,
  roles,
  busy,
  onRole,
  onRemove,
}: {
  member: Member;
  roles: RoleOption[];
  busy: boolean;
  onRole: (role: string) => void;
  onRemove: () => void;
}) {
  const name = `${member.first_name} ${member.last_name}`.trim() || member.email;
  // The member's own role is always offered, even when it is above what this person may give.
  const options = roles.some((r) => r.value === member.role)
    ? roles
    : [{ value: member.role, label: member.role_label ?? member.role }, ...roles];
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-white"
          aria-hidden
        >
          {member.initials}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-semibold text-gray-900">{name}</span>
            {member.is_you ? <span className={TAG}>You</span> : null}
            {member.subscriber ? (
              <span
                className={TAG}
                title="Billing for this company is on this person's card. Only they can change its modules, and only if they are an admin."
              >
                Subscriber
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-gray-500">{member.email}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
        {member.can_change_role ? (
          <select
            aria-label={`Role of ${name}`}
            className={ROLE_SELECT}
            value={member.role}
            disabled={busy}
            onChange={(e) => onRole(e.target.value)}
          >
            {options.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <span className={TAG}>{member.role_label ?? member.role}</span>
        )}
        {member.can_remove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Remove ${name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-strong disabled:opacity-50"
          >
            {/* Flask's Users tab's trash icon, as it was */}
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" aria-hidden>
              <path
                d="M11.7497 3.50003H15.5V5.00013H13.9996V14.75C13.9996 14.96 13.9274 15.1375 13.7824 15.2825C13.6375 15.4275 13.4601 15.5 13.2501 15.5H2.74994C2.53994 15.5 2.36258 15.4275 2.21759 15.2825C2.0726 15.1375 2.00038 14.96 2.00038 14.75V5.00013H0.5V3.50003H4.25031V1.2502C4.25031 1.04021 4.32253 0.862556 4.46752 0.717527C4.61252 0.5725 4.78988 0.5 4.99987 0.5H11.0001C11.2101 0.5 11.3875 0.5725 11.5325 0.717527C11.6775 0.862556 11.7497 1.04021 11.7497 1.2502V3.50003ZM12.4999 5.00013H3.50013V14.0001H12.4999V5.00013ZM5.75006 7.25011H7.24981V11.7501H5.75006V7.25011ZM8.75019 7.25011H10.2499V11.7501H8.75019V7.25011ZM5.75006 2.00009V3.50003H10.2499V2.00009H5.75006Z"
                fill="currentColor"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </li>
  );
}

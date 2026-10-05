/**
 * The Manage Subscriptions list's columns (Figma 04-A), in one place because three things draw
 * them: the column heads and the rows (`SubscriptionsTable`) and the loading rows (`ListStates`).
 *
 * The four columns need ~820px, so they start at `lg`. Below it (a phone, a tablet) the name and
 * the chevron/⋮ share the top line and each module cell takes a full line of its own.
 */

/** The four columns, from `lg` up. Also the column heads' layout there. */
export const LIST_LG_COLUMNS = "lg:grid lg:grid-cols-[minmax(200px,1.3fr)_1fr_1fr_auto] lg:gap-6";
/** A row. */
export const LIST_GRID = `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 ${LIST_LG_COLUMNS}`;
/** A row's padding and height. */
export const LIST_ROW = "rounded-xl px-4 py-4 sm:px-7 sm:py-5 lg:min-h-[125px]";
/** A module cell's place in a row: its own full line below `lg`. */
export const LIST_CELL = "col-span-2 lg:col-span-1";
/** The chevron/⋮ group's place in a row: last in the DOM, beside the name below `lg`. */
export const LIST_ACTIONS = "col-start-2 row-start-1 lg:col-start-auto lg:row-start-auto";

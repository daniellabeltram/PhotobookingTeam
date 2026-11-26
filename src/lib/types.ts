// Browser-side names for the API types. shared/api-types.ts is the source of truth.
import type {
  AdminActionData,
  AdminBlockCreateRequest,
  AdminBookingDetail,
  AdminBookingListData,
  AdminBookingListItem,
  AdminMiniSlotsResponse,
  AdminSessionData,
  AvailabilityData,
  CreateBookingData,
  CreateBookingRequest,
  MiniDayItem,
  OverlappingBooking,
  PolicyDocument,
} from '../../shared/api-types';

export type {
  AdminAction,
  AmountDue,
  AvailabilityDay,
  BlockItem,
  BookingFlag,
  BookingStatus,
  CancellationReason,
  ClientEmailKind as EmailKind,
  Money,
  PublicConfig,
  PublicSessionType,
  RescheduleReason,
  Slot,
} from '../../shared/api-types';

export type PolicyDoc = PolicyDocument;
export type Availability = AvailabilityData;
export type BookingRequestBody = CreateBookingRequest;
export type BookingResult = CreateBookingData & { calendarUrl?: string | null };
export type AdminSession = AdminSessionData;
export type BookingListItem = AdminBookingListItem;
export type BookingList = AdminBookingListData;
export type BookingDetail = AdminBookingDetail;
export type ActionResult = AdminActionData;
export type BlockCreateBody = AdminBlockCreateRequest;
export type OverlapBooking = OverlappingBooking;
export type MiniDay = MiniDayItem;
export type MiniSlotsResult = AdminMiniSlotsResponse['data'];

export type BookingFilters = {
  view?: 'upcoming' | 'past' | 'all';
  status?: string;
  rescheduled?: string;
  flag?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: string;
};

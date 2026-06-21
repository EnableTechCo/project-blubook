import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsRead,
  type NotificationRecord,
} from "@/services/notifications.service";
import { baseApi } from "@/store/redux/api/base-api";

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listNotifications: builder.query<NotificationRecord[], string>({
      queryFn: async (userId) => {
        try {
          const data = await listNotifications(userId);
          return { data };
        } catch (error) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error:
                error instanceof Error
                  ? error.message
                  : "Could not load notifications.",
            },
          };
        }
      },
      providesTags: (_result, _error, userId) => [
        { type: "Notifications", id: userId },
      ],
    }),
    markNotificationRead: builder.mutation<
      NotificationRecord,
      { notificationId: string; userId: string }
    >({
      queryFn: async (input) => {
        try {
          const data = await markNotificationRead(input);
          return { data };
        } catch (error) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error:
                error instanceof Error
                  ? error.message
                  : "Could not mark notification as read.",
            },
          };
        }
      },
      invalidatesTags: (_result, _error, input) => [
        { type: "Notifications", id: input.userId },
      ],
    }),
    markNotificationsRead: builder.mutation<
      void,
      { notificationIds: string[]; userId: string }
    >({
      queryFn: async (input) => {
        try {
          await markNotificationsRead(input);
          return { data: undefined };
        } catch (error) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error:
                error instanceof Error
                  ? error.message
                  : "Could not mark notifications as read.",
            },
          };
        }
      },
      invalidatesTags: (_result, _error, input) => [
        { type: "Notifications", id: input.userId },
      ],
    }),
    markAllNotificationsRead: builder.mutation<void, string>({
      queryFn: async (userId) => {
        try {
          await markAllNotificationsRead(userId);
          return { data: undefined };
        } catch (error) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error:
                error instanceof Error
                  ? error.message
                  : "Could not mark all notifications as read.",
            },
          };
        }
      },
      invalidatesTags: (_result, _error, userId) => [
        { type: "Notifications", id: userId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkNotificationsReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;

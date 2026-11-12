import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";

export const meQuery = queryOptions({ queryKey: ["me"], queryFn: api.me });

export const companiesQuery = queryOptions({
	queryKey: ["companies"],
	queryFn: api.companies,
});

export const companyQuery = (companyId: string) =>
	queryOptions({
		queryKey: ["companies", companyId],
		queryFn: () => api.company(companyId),
	});

/** Tudo o que depende dos cards de uma empresa fica sob esta chave, para invalidar junto. */
export const contentsKey = (companyId: string) => [
	"companies",
	companyId,
	"contents",
];

export const contentsQuery = (companyId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "all"],
		queryFn: () => api.contents(companyId),
	});

export const calendarQuery = (companyId: string, from: string, to: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "calendar", from, to],
		queryFn: () => api.calendar(companyId, from, to),
	});

export const trashQuery = (companyId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "trash"],
		queryFn: () => api.trash(companyId),
	});

export const contentQuery = (companyId: string, contentId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "one", contentId],
		queryFn: () => api.content({ companyId, contentId }),
	});

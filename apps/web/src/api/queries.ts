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

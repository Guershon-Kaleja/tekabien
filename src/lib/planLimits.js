export const PLAN_LIMITS = {
  free: {
    maxSalesPerDay: 5,
    maxProducts: 5,
    maxClients: 3,
    canExportPDF: false,
    canViewReports: false,
  },
  trial: {
    maxSalesPerDay: Infinity,
    maxProducts: Infinity,
    maxClients: Infinity,
    canExportPDF: true,
    canViewReports: true,
  },
  pro: {
    maxSalesPerDay: Infinity,
    maxProducts: Infinity,
    maxClients: Infinity,
    canExportPDF: true,
    canViewReports: true,
  },
}

export const getPlanLimits = (plan) => {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}

export const canAddProduct = (plan, currentCount) => {
  const limits = getPlanLimits(plan)
  return currentCount < limits.maxProducts
}

export const canAddClient = (plan, currentCount) => {
  const limits = getPlanLimits(plan)
  return currentCount < limits.maxClients
}

export const canAddSale = (plan, todaySalesCount) => {
  const limits = getPlanLimits(plan)
  return todaySalesCount < limits.maxSalesPerDay
}
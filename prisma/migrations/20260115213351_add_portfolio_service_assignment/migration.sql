-- CreateTable
CREATE TABLE "PortfolioItemService" (
    "portfolioItemId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioItemService_pkey" PRIMARY KEY ("portfolioItemId","serviceId")
);

-- CreateIndex
CREATE INDEX "PortfolioItemService_serviceId_idx" ON "PortfolioItemService"("serviceId");

-- CreateIndex
CREATE INDEX "PortfolioItemService_portfolioItemId_idx" ON "PortfolioItemService"("portfolioItemId");

-- AddForeignKey
ALTER TABLE "PortfolioItemService" ADD CONSTRAINT "PortfolioItemService_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItemService" ADD CONSTRAINT "PortfolioItemService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

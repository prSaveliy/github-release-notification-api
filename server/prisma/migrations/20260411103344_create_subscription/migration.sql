-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenTag" TEXT,
    "confirmationToken" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_confirmationToken_key" ON "Subscription"("confirmationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_unsubscribeToken_key" ON "Subscription"("unsubscribeToken");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_email_repo_key" ON "Subscription"("email", "repo");

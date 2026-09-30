-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('CONNECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('STARTING', 'ACTIVE', 'STOPPING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "OcpiParty" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "versionsUrl" TEXT NOT NULL,
    "endpoints" JSONB NOT NULL,
    "outgoingToken" TEXT NOT NULL,
    "incomingTokenHash" TEXT NOT NULL,
    "status" "PartyStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcpiParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "countryCode" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("countryCode","partyId","id")
);

-- CreateTable
CREATE TABLE "OcpiSession" (
    "countryCode" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "kwh" DOUBLE PRECISION NOT NULL,
    "authorizationReference" TEXT,
    "data" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcpiSession_pkey" PRIMARY KEY ("countryCode","partyId","id")
);

-- CreateTable
CREATE TABLE "Cdr" (
    "countryCode" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "totalEnergy" DOUBLE PRECISION NOT NULL,
    "totalCost" JSONB NOT NULL,
    "currency" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cdr_pkey" PRIMARY KEY ("countryCode","partyId","id")
);

-- CreateTable
CREATE TABLE "Token" (
    "uid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "whitelist" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "partyRef" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "evseUid" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "partyRef" TEXT NOT NULL,
    "tokenUid" TEXT NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'STARTING',
    "sessionId" TEXT,
    "kwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cdrId" TEXT,
    "totalCostExclVat" DOUBLE PRECISION,
    "totalCostInclVat" DOUBLE PRECISION,
    "currency" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OcpiParty_incomingTokenHash_key" ON "OcpiParty"("incomingTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OcpiParty_countryCode_partyId_key" ON "OcpiParty"("countryCode", "partyId");

-- CreateIndex
CREATE INDEX "OcpiSession_authorizationReference_idx" ON "OcpiSession"("authorizationReference");

-- CreateIndex
CREATE INDEX "Cdr_sessionId_idx" ON "Cdr"("sessionId");

-- CreateIndex
CREATE INDEX "Charge_sessionId_idx" ON "Charge"("sessionId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_partyRef_fkey" FOREIGN KEY ("partyRef") REFERENCES "OcpiParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_partyRef_fkey" FOREIGN KEY ("partyRef") REFERENCES "OcpiParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_tokenUid_fkey" FOREIGN KEY ("tokenUid") REFERENCES "Token"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

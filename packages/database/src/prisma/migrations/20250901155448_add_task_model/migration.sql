-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "virtualMachineId" TEXT,
    "createdOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" DATETIME NOT NULL
);

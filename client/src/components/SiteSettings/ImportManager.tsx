"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useGetSiteImports, useCreateSiteImport, useDeleteSiteImport } from "@/api/admin/hooks/useImport";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IS_CLOUD } from "@/lib/const";
import { CsvParser } from "@/lib/import/csvParser";
import { PlausibleCsvParser } from "@/lib/import/plausibleParser";
import { instantImportRybbitExport, parseRybbitExportZip } from "@/lib/import/rybbitExportParser";
import { ImportPlatform } from "@/types/import";
import { DisabledOverlay } from "@/components/DisabledOverlay";
import { toast } from "@/components/ui/sonner";

interface ImportManagerProps {
  siteId: number;
  disabled: boolean;
}

const CONFIRM_THRESHOLD = 100 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  const sizeInMB = bytes / 1024 / 1024;
  const sizeInGB = bytes / 1024 / 1024 / 1024;

  if (sizeInGB < 1) {
    return `${sizeInMB.toFixed(2)} MB`;
  } else {
    return `${sizeInGB.toFixed(2)} GB`;
  }
}

function formatPlatformName(platform: ImportPlatform): string {
  const platformNames: Record<ImportPlatform, string> = {
    umami: "Umami",
    simple_analytics: "Simple Analytics",
    plausible: "Plausible",
    rybbit_export: "Rybbit Export",
  };
  return platformNames[platform];
}

export function ImportManager({ siteId, disabled }: ImportManagerProps) {
  const t = useExtracted();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [importToDelete, setImportToDelete] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<ImportPlatform | "">("");
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerManagerRef = useRef<CsvParser | PlausibleCsvParser | null>(null);

  function validateFile(file: File | null, platform: ImportPlatform | ""): string {
    if (!file) {
      return t("Please select a file");
    }

    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (platform === "plausible" || platform === "rybbit_export") {
      if (extension !== ".zip" && !["application/zip", "application/x-zip-compressed"].includes(file.type)) {
        return platform === "plausible"
          ? t("Please upload a ZIP file exported from Plausible")
          : t("Please upload a ZIP file exported from Rybbit");
      }
    } else {
      if (extension !== ".csv" && file.type !== "text/csv") {
        return t("Only CSV files are accepted");
      }
    }

    return "";
  }

  const { data, isLoading, error } = useGetSiteImports(siteId);
  const createImportMutation = useCreateSiteImport(siteId);
  const deleteMutation = useDeleteSiteImport(siteId);

  useEffect(() => {
    return () => {
      workerManagerRef.current?.cancel();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setFileError(validateFile(file, selectedPlatform));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || fileError) return;

    if (selectedFile.size > CONFIRM_THRESHOLD) {
      setShowConfirmDialog(true);
    } else {
      executeImport();
    }
  };

  const executeImport = async () => {
    if (!selectedFile || !selectedPlatform) return;

    const file = selectedFile;
    const platform = selectedPlatform;

    createImportMutation.mutate(
      { platform },
      {
        onSuccess: async response => {
          const { importId, allowedDateRange } = response.data;

          try {
            if (platform === "rybbit_export") {
              const timeseries = await parseRybbitExportZip(file);
              const result = await instantImportRybbitExport(siteId, importId, timeseries);
              toast.success(
                `Imported ${result.importedDays} days (${result.importedPageviews.toLocaleString()} pageviews)`
              );
              await queryClient.invalidateQueries({ queryKey: ["get-site-imports", siteId] });
              await queryClient.invalidateQueries({ queryKey: ["overview"] });
              await queryClient.invalidateQueries({ queryKey: ["overview-bucketed"] });
              await queryClient.invalidateQueries({ queryKey: ["overview-bucketed-past-minutes"] });
              await queryClient.invalidateQueries({ queryKey: ["metric"] });
              await queryClient.invalidateQueries({ queryKey: ["revenue-overview"] });
              await queryClient.invalidateQueries({ queryKey: ["revenue-time-series"] });
            } else if (platform === "plausible") {
              const parser = new PlausibleCsvParser(
                siteId,
                importId,
                allowedDateRange.earliestAllowedDate,
                allowedDateRange.latestAllowedDate
              );
              workerManagerRef.current = parser;
              await parser.startImport(file);
            } else {
              const parser = new CsvParser(
                siteId,
                importId,
                platform,
                allowedDateRange.earliestAllowedDate,
                allowedDateRange.latestAllowedDate
              );
              workerManagerRef.current = parser;
              parser.startImport(file);
            }
          } catch (err) {
            console.error("Import failed:", err);
            toast.error(err instanceof Error ? err.message : "Import failed");
            await queryClient.invalidateQueries({ queryKey: ["get-site-imports", siteId] });
          }

          setSelectedFile(null);
          setSelectedPlatform("");
          setFileError("");
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        },
      }
    );

    setShowConfirmDialog(false);
  };

  const handleDeleteClick = (importId: string) => {
    setImportToDelete(importId);
  };

  const handleDeleteConfirm = () => {
    if (importToDelete) {
      deleteMutation.mutate(importToDelete, {
        onSuccess: () => {
          setImportToDelete(null);
        },
        onError: () => {
          setImportToDelete(null);
        },
      });
    }
  };

  const getStatusInfo = (completedAt: string | null) => {
    if (completedAt === null) {
      return {
        color: "bg-blue-100 text-blue-800 border-blue-200",
        icon: Loader2,
        label: t("In Progress"),
      };
    } else {
      return {
        color: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle2,
        label: t("Completed"),
      };
    }
  };

  const sortedImports = useMemo(() => {
    if (!data?.data) {
      return [];
    }

    return data.data.toSorted((a, b) => {
      const aTime = new Date(a.startedAt).getTime();
      const bTime = new Date(b.startedAt).getTime();
      return bTime - aTime;
    });
  }, [data?.data]);

  const hasActiveImport = IS_CLOUD && sortedImports.some(imp => imp.completedAt === null);

  const isImportDisabled =
    !selectedFile || !selectedPlatform || !!fileError || createImportMutation.isPending || disabled || hasActiveImport;

  return (
    <DisabledOverlay message="Data Import" requiredPlan="standard">
      <div className="space-y-6">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("Import Data")}
            </CardTitle>
            <CardDescription>{t("Import data from other analytics platforms.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Active Import Warning */}
            {hasActiveImport && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t(
                    "You have an active import in progress. Please wait for it to complete before starting a new import."
                  )}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label htmlFor="platform">{t("Platform")}</Label>
                <Select
                  value={selectedPlatform}
                  onValueChange={(value: ImportPlatform) => {
                    setSelectedPlatform(value);
                    setSelectedFile(null);
                    setFileError("");
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  <SelectTrigger id="platform" disabled={disabled || createImportMutation.isPending || hasActiveImport}>
                    <SelectValue placeholder={t("Select platform")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="umami">Umami</SelectItem>
                    <SelectItem value="simple_analytics">Simple Analytics</SelectItem>
                    <SelectItem value="plausible">Plausible</SelectItem>
                    <SelectItem value="rybbit_export">Rybbit Export</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="file" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {selectedPlatform === "plausible" || selectedPlatform === "rybbit_export"
                    ? t("ZIP File")
                    : t("CSV File")}
                </Label>
                <Input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept={selectedPlatform === "plausible" || selectedPlatform === "rybbit_export" ? ".zip" : ".csv"}
                  multiple={false}
                  onChange={handleFileChange}
                  disabled={disabled || createImportMutation.isPending || hasActiveImport}
                />
                {fileError && <p className="text-sm text-red-600">{fileError}</p>}
              </div>

              {/* Import Button */}
              <Button type="submit" disabled={isImportDisabled} className="w-full sm:w-auto">
                {createImportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("Importing...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {t("Import")}
                  </>
                )}
              </Button>
            </form>

            {/* Import Error */}
            {createImportMutation.isError && (
              <Alert variant="destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {createImportMutation.error.message || t("Failed to import file. Please try again.")}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Delete Error Message */}
            {deleteMutation.isError && (
              <Alert variant="destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {deleteMutation.error.message || t("Failed to delete import. Please try again.")}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Import History */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Import History")}</CardTitle>
            <CardDescription>{t("Track the status of your data imports")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>{t("Loading import history...")}</span>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("Failed to load import history. Please try refreshing the page.")}
                </AlertDescription>
              </Alert>
            ) : !data?.data?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("No imports yet")}</p>
                <p className="text-sm">{t("Upload a CSV file to get started")}</p>
              </div>
            ) : (
              <div className="rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Started At")}</TableHead>
                      <TableHead>{t("Platform")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead className="text-right">{t("Imported")}</TableHead>
                      <TableHead className="text-right">{t("Skipped")}</TableHead>
                      <TableHead className="text-right">{t("Invalid")}</TableHead>
                      <TableHead className="text-center">{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedImports.map(imp => {
                      const statusInfo = getStatusInfo(imp.completedAt);
                      const StatusIcon = statusInfo.icon;
                      const startedAt = DateTime.fromSQL(imp.startedAt).toFormat("MMM dd, yyyy HH:mm");

                      return (
                        <TableRow key={imp.importId}>
                          <TableCell className="font-medium">{startedAt}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{formatPlatformName(imp.platform)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                              <StatusIcon className={`h-3 w-3 ${imp.completedAt === null ? "animate-spin" : ""}`} />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{imp.importedEvents.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {imp.skippedEvents > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-yellow-600 cursor-help">
                                      {imp.skippedEvents.toLocaleString()}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">{t("Events exceeded quota or date range limits")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {imp.invalidEvents > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-red-600 cursor-help">
                                      {imp.invalidEvents.toLocaleString()}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">{t("Events failed validation")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {(imp.completedAt !== null || !IS_CLOUD) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(imp.importId)}
                                disabled={disabled || deleteMutation.isPending}
                                className="h-8 w-8 p-0"
                              >
                                {deleteMutation.isPending && deleteMutation.variables === imp.importId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Confirm Large File Import")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  "You're about to import a large file ({size}). This may take several minutes to process. Are you sure you want to continue?",
                  { size: selectedFile ? formatFileSize(selectedFile.size) : "?" }
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={executeImport}>{t("Yes, Import File")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!importToDelete} onOpenChange={open => !open && setImportToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Delete Import")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  "Are you sure you want to delete this import? This action cannot be undone. The imported data will be permanently removed."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                {t("Delete Import")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DisabledOverlay>
  );
}

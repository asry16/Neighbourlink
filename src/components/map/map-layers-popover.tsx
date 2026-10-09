"use client";

import React from "react";
import {
  X,
  Layers,
  Map as MapIcon,
  Globe,
  AlertTriangle,
  TrendingUp,
  FileText,
  LifeBuoy,
  Building2,
  Check,
  Compass,
} from "lucide-react";
import { useDemo } from "@/context/demo-context";
import type { BasemapType } from "@/lib/map-styles";

interface MapLayersPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  is3D: boolean;
  onToggle3D: () => void;
}

export function MapLayersPopover({
  isOpen,
  onClose,
  is3D,
  onToggle3D,
}: MapLayersPopoverProps) {
  const { basemapType, setBasemapType, layerFilters, toggleLayer } = useDemo();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-rise"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-display-title"
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="sm:hidden flex justify-center -mt-2 mb-2">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 id="map-display-title" className="text-base font-bold">
                Map View & Layers
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose basemap style and visible hazard overlays
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close layers menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group A: Map Type (Basemap) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Map Type
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Street Option */}
            <button
              type="button"
              onClick={() => setBasemapType("street")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[88px] relative ${
                basemapType === "street"
                  ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 ring-2 ring-sky-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <MapIcon className="w-4 h-4" />
                </div>
                {basemapType === "street" && (
                  <span className="p-1 rounded-full bg-sky-600 text-white">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div>
                <span className="font-bold text-xs block text-slate-900 dark:text-slate-100">
                  Street Map
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                  High-contrast roads, water, and building outlines
                </span>
              </div>
            </button>

            {/* Satellite Option */}
            <button
              type="button"
              onClick={() => setBasemapType("satellite")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[88px] relative ${
                basemapType === "satellite"
                  ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 ring-2 ring-sky-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Globe className="w-4 h-4" />
                </div>
                {basemapType === "satellite" && (
                  <span className="p-1 rounded-full bg-sky-600 text-white">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div>
                <span className="font-bold text-xs block text-slate-900 dark:text-slate-100">
                  Satellite (Hybrid)
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">
                  Aerial imagery with streets and place labels
                </span>
              </div>
            </button>
          </div>
          {basemapType === "satellite" && (
            <p className="text-[10px] text-slate-400 italic leading-snug px-1">
              *Notice: Photographic satellite imagery provides geographic aerial reference and is not real-time footage.
            </p>
          )}
        </div>

        {/* 2D / 3D Perspective Control */}
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Compass className="w-4 h-4 text-sky-500" />
            <div>
              <span className="text-xs font-bold block text-slate-900 dark:text-slate-100">
                3D Perspective View
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                {is3D ? "Pitched perspective with building heights" : "Standard flat overhead map view"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle3D}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer min-h-[44px] min-w-[54px] flex items-center justify-center ${
              is3D
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {is3D ? "3D Active" : "2D"}
          </button>
        </div>

        {/* Group B: Hazard Overlays */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Hazard Overlays
          </label>
          <div className="space-y-1.5">
            {/* Official Hazards */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs min-h-[44px]">
              <div className="flex items-center space-x-2.5 text-slate-800 dark:text-slate-200">
                <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">Official Hazard Warnings</span>
                  <span className="text-[10px] text-slate-400 block">Meteorological and government bulletins</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={layerFilters.officialHazards}
                onChange={() => toggleLayer("officialHazards")}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </label>

            {/* Flood Risk Models */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs min-h-[44px]">
              <div className="flex items-center space-x-2.5 text-slate-800 dark:text-slate-200">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">Flood Risk Indicators</span>
                  <span className="text-[10px] text-slate-400 block">Rule-based rainfall & tidal models</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={layerFilters.riskEstimates}
                onChange={() => toggleLayer("riskEstimates")}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </label>

            {/* Community Reports */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs min-h-[44px]">
              <div className="flex items-center space-x-2.5 text-slate-800 dark:text-slate-200">
                <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">Community Reports</span>
                  <span className="text-[10px] text-slate-400 block">Citizen observations & corroborations</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={layerFilters.communityReports}
                onChange={() => toggleLayer("communityReports")}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </label>

            {/* SOS Requests */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs min-h-[44px]">
              <div className="flex items-center space-x-2.5 text-slate-800 dark:text-slate-200">
                <div className="w-6 h-6 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <LifeBuoy className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">Emergency SOS Areas</span>
                  <span className="text-[10px] text-slate-400 block">Rescue request zones (approximate for privacy)</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={layerFilters.sosAreas}
                onChange={() => toggleLayer("sosAreas")}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </label>

            {/* Help Centres */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs min-h-[44px]">
              <div className="flex items-center space-x-2.5 text-slate-800 dark:text-slate-200">
                <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold block">Shelters & Help Centres</span>
                  <span className="text-[10px] text-slate-400 block">Relief stations, clean water, and aid</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={layerFilters.helpCentres}
                onChange={() => toggleLayer("helpCentres")}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Done Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

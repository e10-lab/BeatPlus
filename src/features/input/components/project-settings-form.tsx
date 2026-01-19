import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import DaumPostcodeEmbed from "react-daum-postcode";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { updateProject } from "@/services/project-service";
import { Project } from "@/types/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { determineClimateZone } from "@/lib/climate-zones";
import { BUILDING_STRUCTURES, BUILDING_USES, CLIMATE_ZONE_LABELS } from "@/lib/constants";
import { findNearestStation } from "@/services/weather-service";
import { WeatherStation } from "@/lib/climate-data";
import { ClimateDataChartDialog } from "./climate-data-chart-dialog";
import {
    Type,
    FileText,
    MapPin,
    Building2,
    Hammer,
    Ruler,
    Maximize,
    Square,
    Layers,
    FileSignature,
    Calendar,
    FileCheck,
    CloudSun
} from "lucide-react";

async function getCoordinates(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const response = await fetch(`/api/geocode?query=${encodeURIComponent(address)}`);

        if (!response.ok) {
            console.error("Geocoding failed:", await response.text());
            return null;
        }

        const data = await response.json();
        if (data.documents && data.documents.length > 0) {
            return {
                lat: parseFloat(data.documents[0].y),
                lng: parseFloat(data.documents[0].x),
            };
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch coordinates:", error);
        return null;
    }
}

const formSchema = z.object({
    name: z.string().min(2, "이름은 2글자 이상이어야 합니다."),
    description: z.string().optional(),
    address: z.string().optional(),
    detailAddress: z.string().optional(),
    city: z.string().optional(),
    climateZone: z.string().optional(),

    siteArea: z.coerce.number().min(0).optional(),
    buildingArea: z.coerce.number().min(0).optional(),
    totalArea: z.coerce.number().min(0).optional(),
    mainPurpose: z.string().optional(),
    mainStructure: z.string().optional(),
    scale: z.string().optional(),
    permitDate: z.string().optional(),
    constructionStartDate: z.string().optional(),
    usageApprovalDate: z.string().optional(),
    weatherStationId: z.number().optional(),

    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
});

interface ProjectSettingsFormProps {
    project: Project;
    onUpdate: (updatedProject: Project) => void;
}

export function ProjectSettingsForm({ project, onUpdate }: ProjectSettingsFormProps) {
    const [loading, setLoading] = useState(false);

    const [openPostcode, setOpenPostcode] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: project.name,
            description: project.description || "",
            address: project.location?.address || "",
            detailAddress: project.location?.detailAddress || "",
            city: project.location?.city || "",
            climateZone: project.location?.climateZone || undefined,
            weatherStationId: project.weatherStationId || undefined,
            totalArea: project.totalArea || 0,
            siteArea: project.siteArea || 0,
            buildingArea: project.buildingArea || 0,
            mainPurpose: project.mainPurpose || "",
            mainStructure: project.mainStructure || "",
            scale: project.scale || "",
            permitDate: project.permitDate || "",
            constructionStartDate: project.constructionStartDate || "",
            usageApprovalDate: project.usageApprovalDate || "",

            latitude: project.location?.latitude || undefined,
            longitude: project.location?.longitude || undefined,
        },
    });



    const handleComplete = (data: any) => {
        let fullAddress = data.address;
        let extraAddress = '';

        if (data.addressType === 'R') {
            if (data.bname !== '') {
                extraAddress += data.bname;
            }
            if (data.buildingName !== '') {
                extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            }
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
        }

        form.setValue("address", fullAddress);

        // 시/도 및 시군구 추출
        // data.sido: "경기도", "서울특별시"
        // data.sigungu: "파주시", "종로구"
        // Determine Climate Zone
        let calculatedZone = undefined;
        if (data.sido) {
            calculatedZone = determineClimateZone(data.sido, data.sigungu || "");
            form.setValue("climateZone", calculatedZone);
        }

        setOpenPostcode(false);

        // Sync with parent immediately for UI update
        const currentValues = form.getValues();
        onUpdate({
            ...project,
            location: {
                ...project.location,
                address: fullAddress,
                // city: data.sido, // data.sido might need processing? existing code didn't use it much.
                climateZone: calculatedZone,
            }
        });

        // Fetch Coordinates
        getCoordinates(fullAddress).then((coords) => {
            if (coords) {
                form.setValue("latitude", coords.lat);
                form.setValue("longitude", coords.lng);

                // Find nearest weather station
                const nearest = findNearestStation(coords.lat, coords.lng);
                let stationId = undefined;

                if (nearest) {
                    stationId = nearest.station.id;
                    // We could also store the distance if needed, but for now just ID is enough for the DB
                }

                // Sync again with coordinates and station
                onUpdate({
                    ...project,
                    location: {
                        ...project.location,
                        address: fullAddress,
                        climateZone: calculatedZone,
                        latitude: coords.lat,
                        longitude: coords.lng,
                    },
                    weatherStationId: stationId,
                });
            }
        });
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!project.id) return;
        setLoading(true);
        try {
            await updateProject(project.id, {
                name: values.name,
                description: values.description,
                location: {
                    address: values.address,
                    detailAddress: values.detailAddress,
                    city: values.city,
                    climateZone: values.climateZone,
                    latitude: values.latitude,
                    longitude: values.longitude,
                },
                siteArea: values.siteArea,
                buildingArea: values.buildingArea,
                totalArea: values.totalArea,
                mainPurpose: values.mainPurpose,
                mainStructure: values.mainStructure,
                scale: values.scale,
                permitDate: values.permitDate,
                constructionStartDate: values.constructionStartDate,
                usageApprovalDate: values.usageApprovalDate,
                weatherStationId: project.weatherStationId, // Preserve the calculated ID
            });

            onUpdate({
                ...project,
                ...values,
                location: {
                    ...project.location,
                    address: values.address,
                    detailAddress: values.detailAddress,
                    city: values.city,
                    climateZone: values.climateZone,
                    latitude: values.latitude,
                    longitude: values.longitude,
                }
            } as Project);

            alert("프로젝트 정보가 저장되었습니다.");
        } catch (error) {
            console.error("Failed to update project:", error);
            alert("저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>프로젝트 상세 정보</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
                        <FormField
                            control={form.control as any}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Type className="h-4 w-4" />
                                        프로젝트 이름
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="프로젝트 이름을 입력하세요" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        설명
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="프로젝트에 대한 설명을 입력하세요" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                                <FormLabel className="mb-0 flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    주소
                                </FormLabel>
                                {(form.watch("latitude") && form.watch("longitude")) && (
                                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md flex items-center gap-2">
                                        <span>(위도: {Number(form.watch("latitude")).toFixed(5)}, 경도: {Number(form.watch("longitude")).toFixed(5)})</span>
                                        {form.watch("climateZone") && (
                                            <>
                                                <span className="w-px h-3 bg-border mx-1" />
                                                <span>
                                                    기후대: {CLIMATE_ZONE_LABELS[form.watch("climateZone") as string] || form.watch("climateZone")}
                                                </span>
                                            </>
                                        )}
                                        {/* Display Nearest Station if coordinates exist */}
                                        {(() => {
                                            const lat = Number(form.watch("latitude"));
                                            const lng = Number(form.watch("longitude"));
                                            const nearest = findNearestStation(lat, lng);
                                            if (nearest) {
                                                return (
                                                    <>
                                                        <span className="w-px h-3 bg-border mx-1" />
                                                        <ClimateDataChartDialog
                                                            station={nearest.station}
                                                            trigger={
                                                                <button type="button" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors">
                                                                    <CloudSun className="h-3 w-3" />
                                                                    기상: {nearest.station.name} ({nearest.distance.toFixed(1)}km)
                                                                    <span className="text-xs underline ml-1">[데이터 보기]</span>
                                                                </button>
                                                            }
                                                        />
                                                    </>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <FormField
                                    control={form.control as any}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem className="flex-[2] space-y-0">
                                            <FormControl>
                                                <Input readOnly placeholder="주소 검색을 이용하세요" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="outline" onClick={() => setOpenPostcode(true)}>
                                    검색
                                </Button>
                                <FormField
                                    control={form.control as any}
                                    name="detailAddress"
                                    render={({ field }) => (
                                        <FormItem className="flex-1 space-y-0">
                                            <FormControl>
                                                <Input placeholder="상세 주소 (동/호수)" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>



                        <Dialog open={openPostcode} onOpenChange={setOpenPostcode}>
                            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
                                <DialogHeader className="px-4 py-2 bg-muted/50 border-b">
                                    <DialogTitle>주소 검색</DialogTitle>
                                    <DialogDescription className="hidden">
                                        우편번호 찾기 서비스를 통해 주소를 검색하세요.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="p-0">
                                    <DaumPostcodeEmbed onComplete={handleComplete} style={{ height: '450px' }} />
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={form.control as any}
                                name="mainPurpose"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4" />
                                            주 용도
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="선택하세요" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {BUILDING_USES.map((use) => (
                                                    <SelectItem key={use} value={use}>
                                                        {use}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="mainStructure"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Hammer className="h-4 w-4" />
                                            주 구조
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="선택하세요" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {BUILDING_STRUCTURES.map((structure) => (
                                                    <SelectItem key={structure} value={structure}>
                                                        {structure}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="scale"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Ruler className="h-4 w-4" />
                                            규모
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="예: 지하1층 지상3층" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>



                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={form.control as any}
                                name="siteArea"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Maximize className="h-4 w-4" />
                                            대지면적 (m²)
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" className="no-spinner" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="buildingArea"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Square className="h-4 w-4" />
                                            건축면적 (m²)
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" className="no-spinner" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="totalArea"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Layers className="h-4 w-4" />
                                            연면적 (m²)
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" className="no-spinner" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={form.control as any}
                                name="permitDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <FileSignature className="h-4 w-4" />
                                            허가일
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="constructionStartDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            착공일
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="usageApprovalDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <FileCheck className="h-4 w-4" />
                                            사용승인일
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={loading}>
                                {loading ? "저장 중..." : "변경사항 저장"}
                            </Button>
                        </div>
                    </form >
                </Form >
            </CardContent >
        </Card >
    );
}

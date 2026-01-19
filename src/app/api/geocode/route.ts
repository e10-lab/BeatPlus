import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query");

    if (!query) {
        return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: "Server configuration error: API Key missing" }, { status: 500 });
    }

    // Debug: Check if API Key is loaded
    console.log(`[Geocode API] Query: ${query}`);
    console.log(`[Geocode API] Key loaded: ${apiKey ? apiKey.substring(0, 4) + '...' : 'NO KEY'}`);

    try {
        const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`, {
            headers: {
                Authorization: `KakaoAK ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Geocode API] Kakao Error ${response.status}:`, errorText);
            return NextResponse.json(
                { error: `Kakao API Error: ${response.status} ${response.statusText}`, details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Geocoding error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MusicController extends Controller
{
    public function search(Request $request)
    {
        $query = $request->validate(['q' => 'required|string|min:2|max:80'])['q'];
        abort_unless(config('services.jamendo.client_id'), 503, 'Kho nhạc chưa được cấu hình.');
        $client = Http::timeout(8)->retry(1, 200);
        if (config('services.jamendo.ca_bundle')) {
            $client->withOptions(['verify' => config('services.jamendo.ca_bundle')]);
        }
        $response = $client->get('https://api.jamendo.com/v3.0/tracks/', [
            'client_id' => config('services.jamendo.client_id'),
            'format' => 'json',
            'limit' => 12,
            'search' => $query,
            'audioformat' => 'mp31',
            'include' => 'licenses',
        ])->throw()->json('results', []);

        return collect($response)->map(fn ($track) => [
            'id' => (string) $track['id'],
            'name' => $track['name'],
            'artist' => $track['artist_name'],
            'audio_url' => $track['audio'],
            'share_url' => $track['shareurl'],
            'license_url' => $track['license_ccurl'] ?? null,
            'image' => $track['album_image'] ?? null,
        ])->filter(fn ($track) => filled($track['audio_url']))->values();
    }
}

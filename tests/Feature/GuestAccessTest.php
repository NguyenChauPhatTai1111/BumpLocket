<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_returns_401_even_without_json_accept_header(): void
    {
        $this->get('/api/me')->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
    }
}

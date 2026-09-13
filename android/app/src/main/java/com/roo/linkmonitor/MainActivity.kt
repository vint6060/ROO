package com.roo.linkmonitor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.height
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import org.osmdroid.config.Configuration
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import androidx.compose.ui.viewinterop.AndroidView
import android.content.Context
import android.preference.PreferenceManager

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Configuration.getInstance().load(this, PreferenceManager.getDefaultSharedPreferences(this))
        setContent { LinkMonitorScreen(this) }
    }
}

private data class Coordinate(val lat: Double, val lon: Double) { companion object }
private data class PredictionRequest(val tx: Coordinate, val rx: Coordinate, val frequencies_mhz: List<Double>, val band: String?, val utc_time: String, val power_w: Double?, val mode: String?, val antenna: String?, val compare_voacap: Boolean = true)
private data class Hourly(val utc_hour: Int, val frequency_mhz: Double, val snr_db: Double, val muf_mhz: Double, val bcr_percent: Double)
private data class PredictionValues(val frequencies_mhz: List<Double> = emptyList(), val muf_mhz: Double? = null, val luf_mhz: Double? = null, val snr_db: Double? = null, val bcr_percent: Double? = null, val hourly: List<Hourly> = emptyList())
private data class SourceStatus(val status: String = "unknown", val fetched_at: String? = null, val message: String? = null)
private data class ComparisonStatus(val status: String = "unknown", val engine: String? = null, val message: String? = null)
private data class PredictionResponse(val status: String, val simulated: Boolean, val cache_hit: Boolean, val cache_stale: Boolean, val data_source: SourceStatus, val values: PredictionValues, val comparison: ComparisonStatus?, val message: String?)
private interface RooApi { @POST("api/predict") suspend fun predict(@Body request: PredictionRequest): PredictionResponse }

@Composable
private fun LinkMonitorScreen(context: Context) {
    var tx by remember { mutableStateOf("55.75, 37.62") }
    var rx by remember { mutableStateOf("59.93, 30.31") }
    var frequencies by remember { mutableStateOf("7.1, 14.2") }
    var dateTimeUtc by remember { mutableStateOf("2026-09-13T12:00Z") }
    var band by remember { mutableStateOf("40m") }
    var power by remember { mutableStateOf("100") }
    var mode by remember { mutableStateOf("SSB") }
    var antenna by remember { mutableStateOf("Dipole") }
    var locator by remember { mutableStateOf("") }
    var backend by remember { mutableStateOf("https://your-host.example/") }
    var status by remember { mutableStateOf("Ready. Tap the map in a production build to place stations.") }
    var result by remember { mutableStateOf<PredictionResponse?>(null) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("ROO / HF link monitor", style = MaterialTheme.typography.headlineSmall)
        Text("Select a transmitter and receiver, then inspect the path.")
        AndroidView(
            modifier = Modifier.fillMaxWidth().height(220.dp),
            factory = {
                MapView(context).apply {
                    setMultiTouchControls(true)
                    controller.setZoom(3.0)
                    controller.setCenter(GeoPoint(30.0, 20.0))
                    overlays.add(Marker(this).apply { position = GeoPoint(55.75, 37.62); title = "Transmitter" })
                    overlays.add(Marker(this).apply { position = GeoPoint(59.93, 30.31); title = "Receiver" })
                }
            },
            update = { it.invalidate() }
        )
        Text("Tap-to-place map markers are represented as TX/RX overlays; coordinates remain editable below.")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(tx, { tx = it }, Modifier.weight(1f), label = { Text("TX lat, lon") })
            OutlinedTextField(rx, { rx = it }, Modifier.weight(1f), label = { Text("RX lat, lon") })
        }
        OutlinedTextField(frequencies, { frequencies = it }, Modifier.fillMaxWidth(), label = { Text("Frequencies MHz") })
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(band, { band = it }, Modifier.weight(1f), label = { Text("Band") })
            OutlinedTextField(power, { power = it }, Modifier.weight(1f), label = { Text("Power W") })
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(mode, { mode = it }, Modifier.weight(1f), label = { Text("Mode") })
            OutlinedTextField(antenna, { antenna = it }, Modifier.weight(1f), label = { Text("Antenna") })
        }
        OutlinedTextField(dateTimeUtc, { dateTimeUtc = it }, Modifier.fillMaxWidth(), label = { Text("UTC date/time") })
        OutlinedTextField(locator, { locator = it }, Modifier.fillMaxWidth(), label = { Text("Maidenhead locator (optional)") })
        OutlinedTextField(backend, { backend = it }, Modifier.fillMaxWidth(), label = { Text("Backend HTTPS URL") })
        Button(onClick = {
            scope.launch {
                status = try {
                    val api = Retrofit.Builder().baseUrl(backend.trimEnd('/') + "/").addConverterFactory(MoshiConverterFactory.create()).build().create(RooApi::class.java)
                    val values = frequencies.split(',').map { it.trim().toDouble() }
                    val response = api.predict(PredictionRequest(Coordinate.parseOrLocator(tx, locator), Coordinate.parseOrLocator(rx, locator), values, band, dateTimeUtc, power.toDouble(), mode, antenna))
                    result = response
                    "Backend ${response.status}: ${if (response.simulated) "SIMULATED" else if (response.cache_stale) "STALE CACHE" else "fresh"}"
                } catch (error: Exception) { "Offline or invalid request: ${error.message ?: "connection failed"}" }
            }
        }, Modifier.fillMaxWidth()) { Text("Run prediction") }
        Text(status)
        result?.let { prediction ->
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Prediction by frequency and UTC hour", style = MaterialTheme.typography.titleMedium)
                Text("MUF ${prediction.values.muf_mhz ?: "unknown"} MHz | SNR ${prediction.values.snr_db ?: "unknown"} dB | BCR ${prediction.values.bcr_percent ?: "unknown"}%")
                Text("${prediction.values.hourly.size} hourly rows available. VOACAP: ${prediction.comparison?.get("status") ?: "not requested"}")
                Text(prediction.message ?: "No additional status.")
            } }
        }
    }
}

private fun Coordinate.Companion.parseOrLocator(value: String, locator: String): Coordinate {
    if (value.isBlank() && locator.isNotBlank()) return maidenhead(locator)
    return parse(value)
}

private fun Coordinate.Companion.parse(value: String): Coordinate {
    val parts = value.split(',').map { it.trim() }
    require(parts.size == 2)
    return Coordinate(parts[0].toDouble(), parts[1].toDouble())
}

private fun maidenhead(locator: String): Coordinate {
    val text = locator.trim().uppercase()
    require(text.length >= 4)
    val lon = (text[0] - 'A') * 20 - 180 + (text[2] - '0') * 2 + if (text.length >= 6) (text[4] - 'A') * (5.0 / 60.0) else 1.0
    val lat = (text[1] - 'A') * 10 - 90 + (text[3] - '0') + if (text.length >= 6) (text[5] - 'A') * (2.5 / 60.0) else 0.5
    return Coordinate(lat, lon)
}

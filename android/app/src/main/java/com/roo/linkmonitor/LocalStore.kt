package com.roo.linkmonitor

import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.RoomDatabase
import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "favorite_routes")
data class FavoriteRoute(@PrimaryKey val id: String, val label: String, val txLocatorOrCoordinates: String, val rxLocatorOrCoordinates: String, val band: String, val updatedUtc: String)

@Entity(tableName = "forecast_cache")
data class CachedForecast(@PrimaryKey val cacheKey: String, val responseJson: String, val freshness: String, val savedUtc: String)

@Dao
interface RooDao {
    @Query("SELECT * FROM favorite_routes ORDER BY updatedUtc DESC") fun favorites(): Flow<List<FavoriteRoute>>
    @Upsert suspend fun saveFavorite(route: FavoriteRoute)
    @Query("SELECT * FROM forecast_cache WHERE cacheKey = :key") suspend fun forecast(key: String): CachedForecast?
    @Upsert suspend fun saveForecast(forecast: CachedForecast)
}

@Database(entities = [FavoriteRoute::class, CachedForecast::class], version = 1)
abstract class RooDatabase : RoomDatabase()

package org.prakritinetx.fieldflash.data.api

import org.prakritinetx.fieldflash.data.models.DeploymentLocationPayload
import org.prakritinetx.fieldflash.data.models.GenericApiResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

interface LocationApiService {
    @POST("nodes/{id}/location")
    suspend fun registerDeploymentLocation(
        @Path("id") nodeId: String,
        @Body payload: DeploymentLocationPayload
    ): Response<GenericApiResponse>
}

